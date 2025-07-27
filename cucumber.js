module.exports = {
  default: {
    require: ['features/step_definitions/**/*.ts'],
    requireModule: ['ts-node/register'],
    format: ['progress', 'html:reports/cucumber-report.html', 'json:reports/cucumber-report.json'],
    paths: ['features/**/*.feature'],
  },
}
