module.exports = function() {
	var commander = require("commander");
	var notifier = require("node-notifier");

	var chokidar = require("chokidar");
	var vfs = require("vinyl-fs");
	var anymatch = require("anymatch");
	var pth = require("path");

	//TODO: remove depedency on through2
	var through2 = require("through2");
	var passThrough = require('stream').PassThrough;
	var plumber = require("gulp-plumber");

	//TODO: remove depedency on superstatic
	var superstatic = require("superstatic/lib/server");
	var tinylr = require("tiny-lr");
	var connectlr = require("connect-livereload");
	var stat = require("fs").lstatSync;

	var colors = require('colors');

	var httpserver;
	var livereload;
	var watcher;

	var moduleblock = {};

	commander
		.version("1.0.0")
		.option("-c, --compile <langs>", "languages to compile", function(i) { return i.split(","); })
		.option("-p, --path <path>", "path to start a server")
		.option("--lrport <port>", "port of the livereload server [35729]", 35729)
		.option("--httpport <port>", "port of the static server [1234]", 1234)
		.option("--noserver", "disable server")
		.option("--list", "list all plugins")
		.option("--noscript", "dont add livereload script")
		.parse(process.argv);

	var exclude = [/(^\.|[\/\\]\.)(?!$)/, "**/node_modules/**", "**/bower_components/**", "**/vendor/**"];
	var compilers = (commander.compile) ? commander.compile : [];
	var cwd = commander.path;

	var lrport = commander.lrport;
	var httpport = commander.httpport;
	var httpenabled = commander.noserver == undefined;
	var uselrmiddleware = commander.noscript == undefined;

	if(cwd === undefined || cwd.length <= 0) {
		cwd = process.cwd();
	} else if(validatePath(cwd)) {
		process.chdir(cwd);
	} else {
		console.log("Invalid path");
		commander.help();
	}

	if(commander.list != undefined) {
		showListModules();
	} else {
		bindWatcher();
		initServer();
	}

	function bindWatcher() {
		watcher = chokidar.watch(".", {
			"persistent": true,
			"cwd": cwd,
			"ignored": exclude
		});

		if(compilers.length > 0) {
			compilers = compilers.reduce(function(memo, name) {
				var module = importModule(name);
				if(module !== null) {
					memo.push(module);
				}

				return memo;
			}, []);
		}

		watcher.on("add", function(x) {
			runModules(x, function(error, file) {
				if(error !== null) {
					logError(error);
				}

				if(file !== null) {
					log("File".gray, file, "has been loaded".green);
				}
			});
		});

		watcher.on("change", function(x) {
			runModules(x, function(error, file) {
				if(error !== null) {
					logError(error);
				}

				if(file !== null) {
					log("File".gray, file, "has changed".cyan);
					notifyChange(file);
				}
				
			});
			
		});

		watcher.on("unlink", function(x) {
			log("File".gray, x, "was removed".magenta);
		});
	}

	function logError(error) {
		var fixedpath = (cwd[cwd.length-1] == pth.sep) ? cwd : cwd + pth.sep;
		var msg = error.exception.message.replace(fixedpath, "");

		var title = pth.relative(cwd, error.file);

		var file_path = /^(.*\..*?):\s*(.*)$/g.exec(msg);

		if(file_path !== null && file_path.length >= 2) {
			var past = file_path[1];

			if(past.indexOf("/") >= 0 && pth.sep == "\\") {
				past = past.replace(/\//g, "\\");
				msg = msg.replace(file_path[1], past).replace(fixedpath, "");
			}

			if(file_path.length >= 3) {
				msg = file_path[2];
			}

			log("File".gray, past, "failed to compile".red);
			console.log(Array(17).join(" ")+msg.gray)

			var title = past.replace(fixedpath, "");
		}

		notifier.notify({
			title: title,
			message: msg,
			icon: pth.resolve(__dirname, "./img/notify_icon.png"),
			sound: false,
			wait: true
		});

	}

	function importModule(name) {
		var module = require(pth.resolve(__dirname, "./modules/"+name+".js")), src = "";
		var fakegulp = {
			src: function(path) {
				src = path;
				return fakegulp;
			},
			pipe: function() { return fakegulp; },
			dest: function() { return fakegulp; },
			on: function() { return fakegulp; }
		};

		module(fakegulp);

		if(src.length > 0) {
			return {
				"src": src,
				"module": module,
				"livereload": (typeof module.livereload !== "undefined") ? module.livereload : true 
			};
		}

		return null;
	}

	function listModules() {
		return require("fs").readdirSync(pth.resolve(__dirname, "./modules")).filter(function(item) {
			return pth.extname(item) == ".js";
		})
	}

	function showListModules() {
		var list = listModules();
		console.log("\n  Modules ("+list.length+"):\n");
		list.forEach(function(item) {
			console.log("    - "+pth.basename(item, ".js"));
		})
	}

	function notifyChange(changed) {
		tinylr.changed(changed);
	}

	function validatePath(path) {
		try {
			return stat(path).isDirectory()
		} catch (e) {}

		return false;
	}

	function initServer() {
		livereload = new tinylr.Server();
		httpserver = superstatic({"port": httpport, "cwd":cwd});

		if(uselrmiddleware) {
			httpserver.use(connectlr({"port": lrport}));
		}
		
		httpserver.use(function(req, res, next) {
			res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
			res.setHeader("Pragma", "no-cache");
			res.setHeader("Expires", "0");
			next();
		});

		tinylr().listen(lrport, function() {
			if(httpenabled) {
				httpserver.listen();
				log("Listening on port:" + (" "+httpport).green);
			}
		});
	}

	function log() {
		var input = [].slice.apply(arguments).join(" ");
		function pad(number) {
			return (number < 10) ? "0"+number : number;
		}

		var date = new Date();
		var time = ("["+pad(date.getHours())+":"+pad(date.getMinutes())+":"+pad(date.getSeconds())+"]").yellow;

		console.log(time, input);
	}

	function runModules(x, callback) {
		var modified = false;
		var fullpath = pth.resolve(cwd, x);

		var gulp = {
			"src": function(globs, opt) {
				return vfs.src(globs, opt).pipe(through2.obj(function(obj, enc, cb) {
					cb(null, anymatch(exclude, pth.relative(cwd, obj.path)) ? null : obj);
				})).pipe(plumber(function(e) {
					callback({"exception": e, "file": x}, null);
				}));
			}, 
			"dest": function(dir, opt) {
				var stream = new passThrough();
				stream.pipe = function(destination, options) { 
					return this.transformStream.pipe(destination, options); 
				};

				stream.on('pipe', function(source) {
					source.unpipe(this);

					this.transformStream = source.pipe(through2.obj(function(obj, enc, cb) {
						moduleblock[obj.path] = true;
						cb(null, obj);
					})).pipe(vfs.dest(dir, opt)).pipe(through2.obj(function(obj, enc, cb) {
						delete moduleblock[obj.path];

						callback(null, obj.path);
						cb(null);
					}));
				});

				return stream;
			}
		}

		if(moduleblock.hasOwnProperty(fullpath)) {
			return; //do not do anything with this file
		}

		compilers.forEach(function(item) {
			if(anymatch(item.src, x)) {
				modified = true;

				if(item.livereload) {
					callback(null, fullpath);
				}

				item.module(gulp);
			}
		});

		if(modified == false) {
			callback(null, fullpath);
		}
	}
}