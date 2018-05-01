'use strict';
var winston = require('winston');

var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      json: false,
      level: 'info',
      formatter: function(options) {
        return options.level.toUpperCase() + ' ' + (options.message ? options.message : '') + JSON.stringify(options.meta);
      },
    }),
    new (winston.transports.File)({
      filename: 'api.log',
      json: false,
      level:'debug',
      formatter: function(options) {
        return options.level.toUpperCase() + ' ' + (options.message ? options.message : '') + JSON.stringify(options.meta);
      },
    })
  ]
});

module.exports = logger;
