var sass = require("gulp-sass");

module.exports = function(gulp) {
	return gulp.src("**/*.scss")
			.pipe(sass())
			.pipe(gulp.dest("./"));
}

module.exports.livereload = false;