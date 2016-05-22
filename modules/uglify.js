var uglify = require('gulp-uglify');
var rename = require("gulp-rename");

module.exports = function(gulp) {
	return gulp.src("**/*.ugly.js")
			.pipe(uglify())
			.pipe(rename(function(path) {
				path.basename = path.basename.replace(".ugly", "");
				return path;
			}))
			.pipe(gulp.dest("./"));
}