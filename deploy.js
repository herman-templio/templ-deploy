import simpleGit, {CleanOptions} from 'simple-git'
import Rsync from 'rsync'

const options = {
    baseDir: process.cwd(),
    binary: 'git',
    maxConcurrentProcesses: 6,
};
console.log(options);
export async function deploy() {
    let config
    try {
        config = (await import(options.baseDir+'/.templ.mjs')).default
    } catch(e) {
        console.log('Unable to import config',options.baseDir+'/.templ.mjs');
        console.log(e.message);
        process.exit(1)
    }

    // console.log(options);
    const git=simpleGit(options)
    const branch = (await git.branchLocal()).current

    console.log('Current branch',branch);
    const templ=process.argv[2]||branch
    const templConfig=config?.templs?.[templ]
    if(!templConfig) {
        console.log('No such templ configured',templ);
        process.exit(1)
    }

    if(!templConfig.app || !templConfig.host) {
        console.log('Config must define an app and a host');
        process.exit(1)
    }

    const dir=config.dir||'dist'
    console.log('Deploying',dir, 'to app', templConfig.app);

    let shell='ssh'
    if(templConfig.port) shell+=` -p ${templConfig.port}`
    let src=(templConfig.dir||'dist/')
    if(!src.endsWith('/')) src += '/'
    const app = templConfig.app
    const user=templConfig.user||`user_${app}`
    const host=templConfig.host
    let dst=`${user}@${host}:`
    dst+= templConfig.dst || `app_${templConfig.app}/`
    if(!dst.endsWith('/')) dst += '/'

    const r=Rsync().shell(shell).flags('avzh').source(src).destination(dst)
    console.log( r.command())
    r.execute((error,code,cmd) => {
        console.log(error,code,cmd);
    })
}