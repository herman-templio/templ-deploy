import simpleGit, {CleanOptions} from 'simple-git'
import Rsync from 'rsync'

const default_options = {
    baseDir: process.cwd(),
    binary: 'git',
    maxConcurrentProcesses: 6,
};

function parseFlags(args,flags) {
    const res={}
    for(let [flag,arg] of Object.entries(flags)) {
        const i = args.indexOf('--'+flag)
        if(i>=0) {
            if(arg) {
                res[flag]=args[i+1]
                args.splice(i,2)
            } else {
                res[flag]=true
                args.splice(i,1)
            }
        }
    }
    return res
}
const flags={
    dry:false,
    rsyncFlags:true,
}
export async function deploy({args, options, callback, baseDir,gitOptions=default_options}={}) {
    let config
    args=args||process.argv.slice(2)
    options = options || parseFlags(args,flags)
    baseDir=baseDir || gitOptions.baseDir || process.cwd()
    try {
        config = (await import(baseDir+'/.templ.mjs')).default
    } catch(e) {
        console.log('Unable to import config',baseDir+'/.templ.mjs');
        console.log(e.message);
        process.exit(1)
    }

    // console.log(options);
    const git=simpleGit(gitOptions)
    const branch = (await git.branchLocal()).current

    console.log('Current branch',branch);
    const templ=args[0]||branch
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

    const r=Rsync().shell(shell).flags(options.rsyncFlags||templConfig.rsyncFlags||'avzh').source(src).destination(dst)
    if(options.dry) {
        console.log( 'Dry run:',r.command() )
        return
    }
    if(!callback) callback=(error,code,cmd) => {
        console.log(error,code,cmd);
    }
    r.execute(callback)
}
