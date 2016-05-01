var stylus = require("gulp-stylus");

module.exports = function(gulp) {
	return gulp.src("**/*.styl")
			.pipe(stylus())
			.pipe(gulp.dest("./"));
}