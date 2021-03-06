var babel = require("gulp-babel");
var rename = require("gulp-rename");

module.exports = function(gulp) {
	return gulp.src("**/*.jsx")
			.pipe(babel())
			.pipe(rename(function(path) {
				path.extname = ".js";
				return path;
			}))
			.pipe(gulp.dest("./"));
}