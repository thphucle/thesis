var gulp = require("gulp");
var ts = require("gulp-typescript");
var clean = require("gulp-clean");
var sourcemaps = require('gulp-sourcemaps');
var tsProject = ts.createProject("tsconfig.json");
var cache = require('gulp-cached');
const GulpSSH = require('gulp-ssh');
const JSON_FILES = ['src/*.json', 'src/**/*.json', 'package.json'];
const gulpConfig = require('./gulpconfig.json');
var fs = require('fs');

var privateKey = '';
try {
  privateKey = fs.readFileSync(gulpConfig.private_key_path);
} catch (e) {
  console.log("Not found privateKey");
}

const config = {
  test: {
    host: 'private.contractium.io',
    port: 22,
    username: 'ubuntu',
    privateKey: privateKey
  }
};

gulp.task("scripts-n-src", function () {
  var tsResult = tsProject.src()
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(tsProject());

  console.log("Build script success!!");

  return tsResult.js
    .pipe(sourcemaps.write("./")) // Now the sourcemaps are added to the .js file
    .pipe(gulp.dest("dist"));
});

gulp.task("scripts", function () {
  var tsResult = tsProject.src()
    .pipe(cache("typescript"))
    .pipe(tsProject())
    .js
    .pipe(gulp.dest("dist"));
});

gulp.task('views', function() {
  return gulp.src('./src/views/**')
    .pipe(gulp.dest('./dist/views/'));
});

gulp.task('email-template', function() {
  return gulp.src('./src/email-template/**')
    .pipe(gulp.dest('./dist/email-template/'));
});

gulp.task('json', function() {
  return gulp.src(JSON_FILES)
    .pipe(gulp.dest('dist'));
});

gulp.task('watch-ts', () => {
  gulp.watch(['src/**/*.ts'], ['scripts']);
});
gulp.task('watch-json', () => {
  gulp.watch(['src/**/*.json'], ['json']);
});
gulp.task('watch-views', () => {
  gulp.watch(['src/views/*'], ['views']);
});
gulp.task('watch-email-template', () => {
  gulp.watch(['src/email-template/*'], ['email-template']);
});
gulp.task('clean', () => {
  return gulp.src('dist', {read: false})
    .pipe(clean());
});


gulp.task('default', ['watch-ts', 'watch-json', 'watch-views', 'views', 'watch-email-template', 'email-template', 'json', 'scripts']);
gulp.task('build', ['views', 'email-template', 'json', 'scripts-n-src']);

gulp.task('migrate-test', 
  () => {
    var gulpSSH = new GulpSSH({
      ignoreErrors: false,
      sshConfig: config.test
    });

    return gulpSSH
    .shell([
      'cd ~/bdlnetwork/bdlnetwork-server/dist', 
      'rm -rf ../dump/*',
      'node run backup',
      'cd ~/bdlnetwork/bdlnetwork-server',
      'git pull origin master', 
      'npm install', 
      'gulp build', 
      'cd ./dist/',
      'node run restore', 
      'NODE_ENV=development pm2 restart network'
    ])}
);

gulp.task('deploy-test', () => {
  var gulpSSH = new GulpSSH({
    ignoreErrors: false,
    sshConfig: config.test
  });

  return gulpSSH
  .shell([
    'cd ~/ctu/ctu', 
    'git pull origin master', 
    'sudo npm install', 
    'gulp build', 
    'docker exec -it ctu_app sh -c "pm2 restart all"'
  ]);
})
