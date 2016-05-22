"use strict"
const path = require("path")
const colors = require('colors')
const notifier = require("node-notifier")

class Logger {
	constructor(cwd, quiet) {
		this.cwd = cwd
		this.quiet = quiet
	}

	static createInstance(cwd, quiet) {
		return new Logger(cwd, quiet)
	}

	static log() {
		var input = [].slice.apply(arguments).join(" ")
		function pad(number) {
			return (number < 10) ? "0"+number : number
		}

		var date = new Date()
		var time = ("["+pad(date.getHours())+":"+pad(date.getMinutes())+":"+pad(date.getSeconds())+"]").yellow

		if (this === undefined || this.quiet === undefined || this.quiet === false) {
			console.log(time, input)
		}
	}

	log() {
		Logger.log.apply(this, arguments)
	}

	error(error) {
		var fixedpath = (this.cwd[this.cwd.length-1] == path.sep) ? this.cwd : this.cwd + path.sep
		var msg = error.exception.message.replace(fixedpath, "")

		var title = path.relative(this.cwd, error.file)

		var file_path = /^(.*\..*?):\s*(.*)$/g.exec(msg)

		if(file_path !== null && file_path.length >= 2) {
			var past = file_path[1]

			if(past.indexOf("/") >= 0 && path.sep == "\\") {
				past = past.replace(/\//g, "\\")
				msg = msg.replace(file_path[1], past).replace(fixedpath, "")
			}

			if(file_path.length >= 3) {
				msg = file_path[2]
			}

			this.log("File".gray, past, "failed to compile".red)
			console.log(Array(17).join(" ")+msg.gray)

			var title = past.replace(fixedpath, "")
		}

		notifier.notify({
			title: title,
			message: msg,
			icon: path.resolve(__dirname, "../img/notify_icon.png"),
			sound: false,
			wait: true
		})
	}
}

module.exports = Logger