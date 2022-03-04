module.exports = (o) => (api) => {
  api.registerCommands('clean', () => {
    console.log('执行了 clean 命令的逻辑', o)
  })
}