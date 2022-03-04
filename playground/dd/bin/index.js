#!/usr/bin/env node

const webpack = require('webpack')
const minimist = require('minimist')
const path = require('path')
const innerWebpackConfig = require('../webpack.config')
const USER_CUSTOM_CONFIG_PATH = 'dd.config.js'

 

const build = () => {
  webpack(innerWebpackConfig, (err) => {
    if (err) {
      console.error(err)
      return
    }

    console.log('build success')
  })
}

const readUserConfig = () => {
  return new Promise(resolve => {
    const userConfig = require(path.join(process.pwd(), USER_CUSTOM_CONFIG_PATH)) || {}
    resolve(userConfig)
  })
}

readUserConfig.then((config) => {

  build()
})