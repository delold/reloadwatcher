"use strict"
const fs = require("fs")
const path = require("path")

const vfs = require("vinyl-fs")
const colors = require('colors')
const anymatch = require("anymatch")

const through2 = require("through2")
const plumber = require("gulp-plumber")

const util = require("util")
const log = require("./log")

class ModuleHandler {
	constructor(cwd) {
		this.compilers = []
		this.moduleblock = {}
		this.compileHistory = {}
		this.cwd = cwd
	}

	load(list) {
		if (list === undefined || list.length <= 0) {
			return
		}

		this.compilers = list.reduce(function(memo, name) {
			var module = Utils.import(name)
			if(module !== null) {
				memo.push(module)
			}

			return memo
		}, [])
	}

	history(file) {
		let item = this.compileHistory[file]
		delete this.compileHistory[file]
		return item
	}

	getModulePipes(module) {
		let pipes = []
		let gulp = {
			src: () => gulp,
			dest: () => false,
			pipe: (pipe) => {
				if (pipe !== false) {
					pipes.push(pipe)
				}
				return gulp
			}
		}
		module(gulp)
		
		return pipes
	}

	execute(file, callback) {
		let modified = false
		let fullpath = path.resolve(this.cwd, file)

		if(this.moduleblock.hasOwnProperty(fullpath)) {
			return //do not do anything with this file
		}

		this.compilers.forEach((item) => {
			if(anymatch(item.src, file)) {
				modified = true

				//collect all pipes in serial order
				this.moduleblock[fullpath] = true

				if (item.opts.singleSrc) {
					file = item.opts.singleSrc
				}

				let src = [file].concat(item.opts.src)
				let dest = item.opts.dest

				if (src.length < 1 || typeof src[1] !== "object" || src[1] == null) {
					src[1] = {}
				}

				src[1].base = this.cwd

				let stream = vfs.src.apply(this, src)
					.pipe(plumber((e) => {
						delete this.moduleblock[fullpath]
						callback({exception: e, file: file}, null)
					}))

				item.modules.forEach((module) => {
					this.getModulePipes(module).forEach((pipe) => {
						stream = stream.pipe(pipe)
					})
				})

				stream.pipe(through2.obj((obj, enc, cb) => {
					this.compileHistory[obj.path] = {module: item.name, from: fullpath}
					cb(null, obj)
				}))
				.pipe(vfs.dest.apply(this, dest))
				.pipe(through2.obj((obj, enc, cb) => {
					delete this.moduleblock[fullpath]
					delete this.compileHistory[obj.path]
					cb(null)
				}))
			}
		})

		if(modified == false) {
			callback(null, fullpath)
		}
	}

}

let Utils = {
	createHandler: function(cwd) {
		return new ModuleHandler(cwd)
	},
	import: function(names) {
		log.log("Importing module", names.red)
		return names.split("+").reduce((parsed, name) => {

			let module = require(path.resolve(__dirname, "../modules/"+name.replace(/=.*|:.*/, "")+".js"))
			let src = ""
			let dest = ""
			let opts = {}


			let gulp = {
				src: function() { 
					src = arguments[0]
					opts.src = Array.prototype.slice.call(arguments, 1)
					return gulp 
				},
				dest: function() { 
					dest = arguments[0]
					opts.dest = Array.prototype.slice.call(arguments, 0)
					return gulp
				},
				pipe: () => gulp
			}

			module(gulp)

			let pathOpts = name.split(":")

			if (pathOpts.length > 1) {
				src = pathOpts[1]

				if (pathOpts.length > 2) {
					dest = pathOpts[2]
				}
			}

			let singleOpts = name.split("->")
			if (singleOpts.length > 1) {
				opts.singleSrc = singleOpts[1]
			}


			if (parsed == null) {
				parsed = {
					name: names,
					src: src,
					dest: dest,
					opts: opts,
					modules: [module]
				}
			} else {
				parsed.dest = dest
				parsed.modules.push(module)
			}

			return parsed
		}, null)
	},
	list: function() {
		return fs.readdirSync(path.resolve(__dirname, "../modules")).filter(function(item) {
			return path.extname(item) == ".js"
		})
	}
}

module.exports = Utils