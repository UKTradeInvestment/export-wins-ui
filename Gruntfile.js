var loadGruntTasks = require( 'load-grunt-tasks' );

module.exports = function( grunt ){

	loadGruntTasks( grunt );

	grunt.initConfig({

		files: {

			css: 'main_2018-04-29.css',
			js: 'main_2018-04-29.min.js',

			bootstrap: {
				css: 'bootstrap_2016-08-31.css',
				js: 'bootstrap_2016-08-31.min.js'
			}
		},

		src: {
			bootstrap: 'bootstrap-sass-3.3.7/assets',
			scss: 'ui/static/ui/scss',
			js: 'ui/static/ui/js'
		},

		dest: {
			vendor: 'ui/static/vendor',
			css: 'ui/static/ui/css',
			js: 'ui/static/ui/js'
		},

		concat: {
			bootstrap: {
				src: [
					//'<%= src.bootstrap %>/javascripts/bootstrap/transition.js',
					//'<%= src.bootstrap %>/javascripts/bootstrap/alert.js',
					'<%= src.bootstrap %>/javascripts/bootstrap/button.js'
					//'<%= src.bootstrap %>/javascripts/bootstrap/carousel.js',
					//'<%= src.bootstrap %>/javascripts/bootstrap/collapse.js',
					//'<%= src.bootstrap %>/javascripts/bootstrap/dropdown.js',
					//'<%= src.bootstrap %>/javascripts/bootstrap/modal.js',
					//'<%= src.bootstrap %>/javascripts/bootstrap/tooltip.js',
					//'<%= src.bootstrap %>/javascripts/bootstrap/popover.js'
					//'<%= src.bootstrap %>/javascripts/bootstrap/scrollspy.js',
					//'<%= src.bootstrap %>/javascripts/bootstrap/tab.js',
					//'<%= src.bootstrap %>/javascripts/bootstrap/affix.js'
				],
				dest: '<%= dest.vendor %>/bootstrap/js/bootstrap.js'
			},
			js: {
				options: {
					sourceMap: true
				},
				src: [
					'<%= src.js %>/ew.js',
					'<%= src.js %>/ew.CustomEvent.js',
					'<%= src.js %>/tools/ew.*.js',
					'<%= src.js %>/**/ew.*.js'
				],
				dest: '<%= dest.js %>/main.js'
			}
		},

		uglify: {
			options: {
				compress: {
					warnings: false
				},
				mangle: true,
				preserveComments: /^!|@preserve|@license|@cc_on/i,
				sourceMap: true
			},
			bootstrap: {
				src: '<%= concat.bootstrap.dest %>',
				dest: '<%= dest.vendor %>/bootstrap/js/<%= files.bootstrap.js %>'
			},
			js: {
				src: '<%= dest.js %>/main.js',
				dest: '<%= dest.js %>/<%= files.js %>'
			}
		},

		sass: {
			options: {
				sourceMap: true,
				outputStyle: 'compact',
				includePaths: [ '<%= src.bootstrap %>/stylesheets' ]
			},
			bootstrap: {
				files: {
					'<%= dest.vendor %>/bootstrap/css/<%= files.bootstrap.css %>': '<%= src.bootstrap %>/stylesheets/main.scss'
				}
			},
			main: {
				files: {
					'<%= dest.css %>/<%= files.css %>': '<%= src.scss %>/main.scss'
				}
			}
		},

		watch: {
			main: {
				files: '<%= src.scss %>/**/*.scss',
				tasks: [ 'sass:main' ]
			},
			bootstrap: {
				files: '<%= src.bootstrap %>/stylesheets/**/*.scss',
				tasks: [ 'sass:bootstrap' ]
			},
			js: {
				files: [ '<%= src.js %>/**/*.js', '!<%= dest.js %>/main*.js' ],
				tasks: [ 'concat:js', 'uglify:js' ]
			}
		}
	});

	grunt.registerTask( 'build', [ 'sass', 'concat', 'uglify' ] );
};
