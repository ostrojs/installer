#!/usr/bin/env node

require('@ostro/support/helpers')
const $app = new(require('@ostro/console'))
$app.add(new(require('./newCommand')))
$app.run(process.argv.slice(2)).then(res=>{
}).catch(err=>{
	console.error(err)
}).finally(res => {
    process.exit(1)
})

