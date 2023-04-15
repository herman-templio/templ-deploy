declare interface DeployOptions {
    /** Directory to deploy with rsync. Default is: dist */
    dir?:string,
    /** Exclude files and directories matching these patterns. */
    exclude?:string[],
    /** Shell-command to run remotely (via ssh) after rsync. */
    sshCmd?:string,
    /** Dependencies to deploy. */
    deps?:string[],
    /** Don't run rsync, only run deploy commands. */
    skipRsync?:boolean
    /** List of files and directories to deploy. May contain wild-cards. Default is to deploy everything in dir that isn't excluded */
    files:string[],
}
/**
 * TemplOptions override all global options
 */
declare interface TemplOptions extends DeployOptions {
    /** Hostname to deploy to. */
    host:string,
    /** Numeric id of templ-website to deploy to. */
    app?:number,
    /** SSH-port. Default=22 */
    port?:number,
    /** SSH User. Default, if app is given, `user_<app>`. */
    user?:string,
    /** Destination directory. Default: `app_<app>` if an app was specified. */
    dst?:string,
}
export declare interface DeployConfig {
    /** Global deploy options */
    options? : DeployOptions,
    templs:{[name:string]:TemplOptions}
}