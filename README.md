# templ-deploy
Deploy files to templ

# Install
Clone this repo into a local directory then do:
```
npm install path/to/templ-deploy
```

# Config
Create a file .templ.mjs containing for example:

```
const config = {
    options:{
        dir:'dist'
    },
    templs:{
        'main':{
            app:1234,
            host:'hostname.com',
            port:22342,
        }
    }
}

export default config
````
Add a script to your package.json:
```
"deploy":"templ-deploy"
```
# Use

Now:
```
npm run deploy main
```
will deploy the local dir named 'dist' to the given host under the default 'app_1234' directory. 

Also:
```
npm run deploy
```
will work provided your currently in a git repo and the current branch is called 'main'.
