import { CRStruct } from './dist/index.js'

const obj = new CRStruct({
  givenName: '',
  familyName: '',
})

obj.givenName = 'Jori'
obj.familyName = 'Lehtinen'

console.log(JSON.stringify(obj))

for (const key in obj) console.log(key)
for (const [key, val] of obj) console.log(key, ':', val)

console.log(JSON.stringify(obj.clone()))
