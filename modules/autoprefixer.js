var autoprefixer = require("gulp-autoprefixer");
var rename = require("gulp-rename");

module.exports = function(gulp) {
	return gulp.src("**/*.unprefix.css")
		.pipe(autoprefixer({
			browsers: ["last 5 versions"],
			cascade: false
		}))
		.pipe(rename(function(path) {
			path.basename = path.basename.replace(".unprefix", "");
			return path;
		}))
		.pipe(gulp.dest("./"));
}