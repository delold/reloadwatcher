var clean = require("gulp-clean-css");
var rename = require("gulp-rename");

module.exports = function(gulp) {
	return gulp.src("**/*.unclean.css")
			.pipe(clean())
			.pipe(rename(function(path) {
				path.basename = path.basename.replace(".unclean", "");
				return path;
			}))
			.pipe(gulp.dest("./"));
}