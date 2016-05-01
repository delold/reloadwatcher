var browser = require('gulp-browser');
var rename = require("gulp-rename");

module.exports = function(gulp) {
	return gulp.src("**/*.npm.js")
			.pipe(browser.browserify())
			.pipe(rename(function(path) {
				path.basename = path.basename.replace(".npm", "");
				return path;
			}))
			.pipe(gulp.dest("./"));
}