import simpleGit, {CleanOptions} from 'simple-git'
import Rsync from 'rsync'
import { SSHCommand } from './ssh.js';

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
    run:true,
}
export async function deploy({args, options, callback, baseDir,gitOptions=default_options}={}) {
    let config
    args=args||process.argv.slice(2)
    options = options || parseFlags(args,flags)
    console.log(options);
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

    if(!(templConfig.app || templConfig.user) || !templConfig.host) {
        console.log('Config must define an app or user, and a host');
        process.exit(1)
    }

    const dir=config.options?.dir||'dist'
    const exclude=config.options?.exclude

    console.log('Deploying',dir, 'to', 
        templConfig.app||templConfig.user);
    if(exclude) console.log('Excluding',exclude);

    let shell='ssh'
    if(templConfig.port) shell+=` -p ${templConfig.port}`
    let src=dir
    if(!src.endsWith('/')) src += '/'
    const app = templConfig.app
    const user=templConfig.user||`user_${app}`
    const host=templConfig.host
    let dst=`${user}@${host}:`
    let dstDir=templConfig.dst || `app_${templConfig.app}/`
    dst+= dstDir
    if(!dst.endsWith('/')) dst += '/'

    const r=Rsync().shell(shell).exclude(exclude||[]).flags(options.rsyncFlags||templConfig.rsyncFlags||'avzh').source(src).destination(dst)
    if(options.dry) {
        console.log( 'Dry run:',r.command() )
        return
    }
    if(!callback) callback=(error,code,cmd) => {
        console.log(error,code,cmd);
    }
    let {error,code,cmd}=await new Promise(resolve=>r.execute((error,code,cmd)=>resolve({error,code,cmd})))
    console.log(cmd);
    if(error) {
        console.log('Error',error);
        return
    }
    const run=options.run||templConfig.run
    if(run) {
        // Run command remotely
        let ssh_dst={host,username:user}
        if(templConfig.port) ssh_dst.port=templConfig.port
        if(templConfig.keyFile) ssh_dst.keyFile=templConfig.keyFile
        let cmd=`cd ${dstDir}; ${run}`
        cmd = new SSHCommand(ssh_dst,cmd)
        try {
            let [code,stdout,stderr] = await cmd.run()
            if(code) {
                console.log('Error code:',code);
            }
            console.log("Stdout:",stdout);
            console.log("Stderr:",stderr);
        } catch(e) {
            console.log(e);
        }
    }
}
