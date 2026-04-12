import { CRStruct } from './dist/index.js'

const obj = new CRStruct({ givenName: '' })

obj.givenName = 'Jori'

console.log(obj.givenName)
