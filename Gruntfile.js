module.exports = function(grunt) {

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
                src: ['public/javascripts/*.js', '!public/javascripts/index_module.js'],
                dest: 'public/javascripts/dist/<%= pkg.name %>.min.js'
            }
        },
        concat: {
            options: {
                separator: ';'
            },
            dist: {
                src: ['public/javascripts/*.js', '!public/javascripts/index_module.js'],
                dest: 'public/javascripts/dist/<%= pkg.name %>.js'
            }
        }
    });

    // Load the plugin that provides the "uglify" task.
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');

    grunt.file.delete("public/javascripts/dist")

    // Default task(s).
    grunt.registerTask('default', ['uglify']);

};