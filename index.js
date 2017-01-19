"use strict"
module.exports = function() {
	const commander = require("commander")
	const chokidar = require("chokidar")
	const colors = require('colors')
	const path = require("path")
	const stat = require("fs").lstatSync

	const superstatic = require("superstatic").server
	const serveIndex = require('serve-index')
	const connectlr = require("connect-livereload")
	const tinylr = require("tiny-lr")

	const log = require("./lib/log")
	const modules = require("./lib/modules")

	commander
		.version("1.0.0")
		.option("-c, --compile <langs>", "languages to compile", function(i) { return i.split(",") })
		.option("-p, --path <path>", "path to start a server")
		.option("--lrport <port>", "port of the livereload server [35729]", 35729)
		.option("--httpport <port>", "port of the static server [80]", 8080)
		.option("--noserver", "disable server")
		.option("--list", "list all plugins")
		.option("--quiet", "run without any output")
		.option("--noscript", "dont add livereload script")
		.option("--target <target>", "watch certain paths", function(i) { return i.split(",") })
		.parse(process.argv)

	let httpserver
	let livereload
	let watcher

	let compilers = (commander.compile) ? commander.compile : []
	let cwd = commander.path
	let lrport = commander.lrport
	let httpport = commander.httpport
	let quiet = commander.quiet !== undefined
	let build = commander.build !== undefined
	let httpenabled = commander.noserver == undefined
	let uselrmiddleware = commander.noscript == undefined
	let watchTarget = (commander.target !== undefined) ? commander.target : "."

	if(cwd === undefined || cwd.length <= 0) {
		cwd = process.cwd()
	} else if (isDirectory(cwd)) {
		process.chdir(cwd)
	} else {
		console.log("Invalid path")
		commander.help()
	}

	let moduleHandler = modules.createHandler(cwd)
	let logger = log.createInstance(cwd, quiet)

	if(commander.list != undefined) {
		showListModules()
	} else {
		logger.log("Starting ReloadWatcher".yellow)
		bindWatcher()
		initServer()
	}

	function bindWatcher() {
		moduleHandler.load(compilers)

		watcher = chokidar.watch(watchTarget, {
			persistent: true,
			cwd: cwd,
			ignored: [/(^\.|[\/\\]\.)(?!$)/, "**/node_modules/**", "**/bower_components/**", "**/vendor/**"]
		})

		watcher.on("add", (target) => {
			moduleHandler.execute(target, (error, file) => {
				if(error !== null) {
					logger.error(error)
				}

				if(file !== null) {
					logger.log("File".gray, file, "has been loaded".green)
				}
			})
		})

		watcher.on("change", (target) => {
			moduleHandler.execute(target, (error, file) => {
				if(error !== null) {
					logger.error(error)
				}

				if(file !== null) {
					let msg = ["File".gray, file]
					msg.push("has changed".cyan)

					let history = moduleHandler.history(file)
					if (history !== undefined) {
						msg.push("from".gray, path.basename(history.from).blue, "by".gray, (history.module).red)
					}

					tinylr.changed(file)
					logger.log.apply(this, msg)
				}
			})
			
		})

		watcher.on("unlink", function(x) {
			logger.log("File".gray, x, "was removed".magenta)
		})
	}

	function showListModules() {
		let list = modules.list()
		console.log("\n  Modules ("+list.length+"):\n")
		list.forEach(function(item) {
			console.log(Array(4).join(" "), "-", path.basename(item, ".js"))
		})
	}

	function isDirectory(path) {
		try {
			return stat(path).isDirectory()
		} catch (e) {}

		return false
	}

	function fileExists(path) {
		try {
			stat(path)
			return true
		} catch (e) {}

		return false
	}

	function initServer() {
		livereload = new tinylr.Server()
		httpserver = superstatic({port: httpport, cwd: cwd})

		var index = serveIndex(cwd, {icons: true, view: "details"})

		if(uselrmiddleware) {
			httpserver.use(connectlr({port: lrport}))
		}
		
		httpserver.use(function(req, res, next) {
			//we're assuming it begins with /
			var dir = path.resolve(cwd, req.url.substring(1))
			var isIndex = isDirectory(dir)

			if (isIndex && !fileExists(path.resolve(dir, "index.html"))) {
				return index(req, res, next)
			} 

			res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
			res.setHeader("Pragma", "no-cache")
			res.setHeader("Expires", "0")

			next()
		})

		tinylr().listen(lrport, function() {
			if(httpenabled) {
				httpserver.listen()
				logger.log("Listening on port:", httpport.toString().green)
			}
		})
	}
}