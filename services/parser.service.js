"use strict";
const Redis = require('ioredis');
const client = Redis.createClient();
const DbService = require("moleculer-db");
const RethinkDBAdapter = require("moleculer-db-adapter-rethinkdb");
let r = require("rethinkdb");
const QueueService = require("moleculer-bull");

// Image parser vars
const axios = require('axios');
const request = require('request-promise-any');
const fs = require('fs');
const cheerio = require('cheerio');
const domain = "https://night2day.ru";
const restaurants = [];




module.exports = {
	name: "parser",

	mixins: [DbService, QueueService()],
	adapter: new RethinkDBAdapter(),
	database: "posts",
	table: "posts",
	settings: {
		fields: ["id", "name"]
	},

	dependencies: [],

	queues: {

		"getEventsByDay": {
			concurrency: 5,
			async process(job) {
				const { urlMain } = job.data;
				axios.get(urlMain).then(res => {
					const result = res.data.match(/\'([0-9]+)\':\{([^\}]+)\}/g).filter(text => /thumb_src/.test(text)).map(text => JSON.parse('{' + text.replace(/'/g, '"') + '}'))
					const nameOfrestaurant = res.data.match(/<title>(.*?)<\/title>/)[0].split('-')[1].trim();
					for (let i = 0; i < Object.keys(result).length; i++) {

						Object.values(result[i]).map(item => {
							const link = domain + item.src;
							const isFound = true; //test(link);
							if (isFound) {
								this.savePhoto(link, urlMain, item.date, nameOfrestaurant);
							}
						});


					}
				}).catch(err => console.log(err));

				return this.Promise.resolve({
					done: true
				})
			}

		} // end of queue


	},

	actions: {
		async scrap() {
			const getHtml = await request('https://night2day.ru/volgograd/gallery/');
			const $ = cheerio.load(getHtml);

			let count = 0;

			$('.wri-image a').each((i, el) => {
				const link = domain + $(el).attr('href');
				restaurants.push(link);
			});

			restaurants.map(async urlMain => {
				this.createJob("getEventsByDay", { urlMain });
		
			});

		}
	},

	/**
	 * Events
	 */
	events: {

	},


	/**
	 * Methods
	 */
	methods: {
		savePhoto(link, urlMain, date, nameOfrestaurant) {

			const getFileName = link.split('/');
			const fileName = getFileName[getFileName.length - 1];

			if (!fs.existsSync('found')) {
				fs.mkdir('found', { recursive: true }, (err) => {
					if (err) throw err;
				});
			}

			const text = `Link: ${urlMain} \n Name: ${nameOfrestaurant} \n Date: ${date}`;

			fs.writeFile(`found/${fileName}.txt`, text, (err) => {
				if (err) throw err;
			});

			// request.get(link, (err, res, body) => {
			// 	request(link).pipe(fs.createWriteStream(`found/${fileName}.jpg`)).on('close', () => { });
			// })

		}


	},

	/**
	 * Service created lifecycle event handler
	 */
	async created() {
		this.redis = await new Redis();
	},
	/**
	 * Service started lifecycle event handler
	 */
	started() {

	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() {

	}
};