// 1. 根源，存哪儿
// 2. 对外暴露api，其实就是使用方式
// 3. 和底层的视图框架结合起来，状态变化了 -> 视图要 re-render

// --------- 框架底层提供的 去中心化的状态管理，只跟组件有关系
const [state, updateState] = React.useState({});
const state = reactive({});

// ---------- 框架底层提供的，中心化管理的方式，这种就可以控制到多个组件的状态
React.creatContext({});
React.useContext()


provider({})
inject({})

// svelte
setContext('ddd', {})
getContext('ddd')


// ----- 针对第二步  范式 - 最佳实践 -- 分形
const store = {
  name: '',
  state: {},
  actions: {},
  mutations: {}
}

const store2 = {
  name: '',
  state: {}, // new Vue({data: ''})
  actions: {},
  mutations: {}
}