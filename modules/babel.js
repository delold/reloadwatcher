var babel = require("gulp-babel");
var rename = require("gulp-rename");

module.exports = function(gulp) {
	return gulp.src("**/*.es6.js")
			.pipe(babel())
			.pipe(rename(function(path) {
				path.basename = path.basename.replace(".es6", "");
				return path;
			}))
			.pipe(gulp.dest("./"));
}

module.exports.livereload = false;