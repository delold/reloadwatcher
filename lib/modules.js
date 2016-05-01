"use strict";
const fs = require("fs");
const path = require("path");

const vfs = require("vinyl-fs");
const colors = require('colors');
const anymatch = require("anymatch");

const through2 = require("through2");
const plumber = require("gulp-plumber");
const PassThrough = require('stream').PassThrough;

const log = require("./log");

class ModuleHandler {
	constructor(cwd) {
		this.compilers = [];
		this.moduleblock = {};
		this.compileHistory = {};
		this.cwd = cwd;
	}

	load(list) {
		if (list === undefined || list.length <= 0) {
			return;
		}

		this.compilers = list.reduce(function(memo, name) {
			var module = Utils.import(name);
			if(module !== null) {
				memo.push(module);
			}

			return memo;
		}, []);
	}

	history(file) {
		let item = this.compileHistory[file];
		delete this.compileHistory[file];
		return item;
	}

	execute(file, callback) {
		let modified = false;
		let fullpath = path.resolve(this.cwd, file);

		let gulp = (module) => {
			return {
				src: (globs, opt) => {
					//block further compilation by any other module
					this.moduleblock[fullpath] = true;
					if (opt === undefined) {
						opt = {};
					}

					opt.base = this.cwd;

					return vfs.src(file, opt).pipe(plumber((e) => {
						delete this.moduleblock[fullpath];
						callback({exception: e, file: file}, null);
					}));
				}, 
				dest: (dir, opt) => {
					let self = this;
					let stream = new PassThrough();
					stream.pipe = function(destination, options) { 
						return this.transformStream.pipe(destination, options); 
					};

					stream.on('pipe', function(source) {
						source.unpipe(this);

						//pipe through combined modules
						this.transformStream = source
							.pipe(through2.obj((obj, enc, cb) => {
								self.compileHistory[obj.path] = {module: module.name, from: fullpath};
								cb(null, obj);
							}))
							.pipe(vfs.dest(dir, opt))
							.pipe(through2.obj((obj, enc, cb) => {
								delete self.moduleblock[fullpath];
								delete self.compileHistory[obj.path];
								cb(null);
							}));
					});

					return stream;
				}
			}
		}

		if(this.moduleblock.hasOwnProperty(fullpath)) {
			return; //do not do anything with this file
		}

		this.compilers.forEach((item) => {
			if(anymatch(item.src, file)) {
				modified = true;
				item.module(gulp(item));
			}
		});

		if(modified == false) {
			callback(null, fullpath);
		}
	}

}

let Utils = {
	createHandler: function(cwd) {
		return new ModuleHandler(cwd);
	},
	import: function(name) {
		log.log("Importing module", name.red)

		let module = require(path.resolve(__dirname, "../modules/"+name+".js"))
		let src = "";
		
		let gulp = {
			src: (path) => { src = path; return gulp; },
			pipe: () => gulp,
			dest: () => gulp,
			on: () => gulp
		};

		module(gulp);

		if(src.length > 0) {
			return {
				name: name,
				src: src,
				module: module,
				notifySrc: (typeof module.notifySrc !== "undefined") ? module.notifySrc : false 
			};
		}

		return null;
	},
	list: function() {
		return fs.readdirSync(path.resolve(__dirname, "../modules")).filter(function(item) {
			return path.extname(item) == ".js";
		});
	}
};

module.exports = Utils;