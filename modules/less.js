var less = require("gulp-less");

module.exports = function(gulp) {
	return gulp.src("**/*.less")
			.pipe(less())
			.pipe(gulp.dest("./"));
}

module.exports.livereload = false;