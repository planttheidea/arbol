var fs = require("fs"),
    path = require("path"),
    webpack = require("webpack"),
    packageJson = fs.readFileSync("package.json"),
    packageJsonParsed = JSON.parse(packageJson),
    banner = '';

banner += 'Library: ' + packageJsonParsed.name + '\n';
banner += 'Description: ' + packageJsonParsed.description + '\n';
banner += 'Author: ' + packageJsonParsed.author + '\n';
banner += 'Version: ' + packageJsonParsed.version + '\n';
banner += 'License: ' + packageJsonParsed.license;

module.exports = {
    cache:true,

    debug:true,

    devServer : {
        contentBase: "./dist",
        host:"localhost",
        inline: true,
        lazy:false,
        noInfo:false,
        quiet:false,
        port: 4000,
        stats:{
            colors:true,
            progress:true
        }
    },

    devtool:"#cheap-module-eval-source-map",

    entry: [
        path.resolve(__dirname, "src/index")
    ],

    eslint:{
        configFile:"./.eslintrc",
        emitError:true,
        failOnError:true,
        failOnWarning:false,
        formatter:require("eslint-friendly-formatter")
    },

    module: {
        preLoaders: [
            {
                exclude: /.idea|dist|node_modules/,
                loader: "eslint-loader",
                test: /\.js$/
            }
        ],

        loaders: [
            {
                exclude: /node_modules/,
                loader: "babel",
                test: /\.(js|jsx)?$/
            }

        ]
    },

    output: {
        filename: "dist/singulum.js",
        library: "singulum",
        libraryTarget: "umd",
        umdNamedDefine: true
    },

    plugins:[
        new webpack.optimize.DedupePlugin(),
        new webpack.DefinePlugin({
            "__ENVIRONMENT__": JSON.stringify(process.env.NODE_ENV)
        }),
        new webpack.NoErrorsPlugin(),
        new webpack.BannerPlugin(banner)
    ],

    resolve:{
        extensions: [
            "",
            ".js",
            ".jsx"
        ],

        /* Allows you to require("models/myModel") instead of needing relative paths */
        fallback : [
            path.join(__dirname, "src")
        ],

        root : __dirname
    }
};