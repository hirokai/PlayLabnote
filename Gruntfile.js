module.exports = function(grunt) {

    var jsfiles = ['public/javascripts/*.js', '!public/javascripts/index_module.js', '!public/javascripts/dagre-d3-custom.js'];

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        uglify: {
            options: {
                banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
                sourceMap: true,
                compress: {
                    drop_console: false
                }
            },
            build: {
                src: jsfiles,
                dest: 'public/javascripts/dist/<%= pkg.name %>.min.js'
            }
        },
        concat: {
            options: {
                separator: ';'
            },
            dist: {
                src: jsfiles,
                dest: 'public/javascripts/dist/<%= pkg.name %>.js'
            }
        },
        htmlmin: {                                     // Task
            dist: {                                      // Target
                options: {                                 // Target options
                    removeComments: true,
                    collapseWhitespace: true
                },
                src: ["public/html/index.html"],
                dest: 'public/html/dist/index.html'
            }
        },
        watch: {
            dev: {
                files: jsfiles,
                tasks: ['uglify']
            }
        }
    });

    // Load the plugin that provides the "uglify" task.
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-htmlmin');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.file.delete("public/javascripts/dist")

    // Default task(s).
    grunt.registerTask('default', ['uglify','htmlmin']);

};