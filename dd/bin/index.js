#!/usr/bin/env node

const webpack = require('webpack');
const minimist = require('minimist');
const path = require('path');

const builtInWebpackConfig = require('../webpack.config');
const args = minimist(process.argv.slice(2));

const fname = 'dd.config.js';

// 存命令，包括用户自定义的命令的
const __commands = {};

// 用户怎么写插件？
const api = {
  // 自定义命令
  registerCommands(name, impl) {
    const command = __commands[name];
    if (!command) {
      __commands[name] = impl;
    }
  },
  chainWepack() {},
}

// 打包
const runWebpackBuild = () => {
  webpack(builtInWebpackConfig, (err, stats) => {
    if (err || stats.hasErrors()) {
      return console.log('build error');
    }

    console.log('build success!');
  })
}

// 支持用户根目录下配置一个文件
const readLocalOption = () => new Promise((resolve) => {
  const config = require(path.join(process.cwd(), fname)) || {};
  const { plugins: { commands = [] } = {} } = config;
  if (commands.length) {
    commands.forEach(command => {
      command(api);
    })
  }

  resolve(__commands)
})

// 如果什么参数都没有，默认执行打包
readLocalOption().then((commands) => {
  const command = args._[0];
  if (commands[command]) {
    commands[command]();
  }
  else {
    runWebpackBuild();
  }
})
