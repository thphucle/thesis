var fs = require("fs");
import * as config from "libs/config";
import misc from "libs/misc";
import request from "request";
import * as sharp from "sharp";
import {schemas} from "../../schemas";

export class ImageHelper {
    async resize(file) {
        try {
            let imageSizeCfg = config.image_size;
            let imageSizes = {
                large: imageSizeCfg && imageSizeCfg.large || 520,
                medium: imageSizeCfg && imageSizeCfg.medium || 460,
                small: imageSizeCfg && imageSizeCfg.small || 240,
                thumbnail: imageSizeCfg && imageSizeCfg.thumbnail || 100
            };
            if (!file || !file.path)
                throw {
                    message: 'file not found'
                };
            let filenameSegments = file.filename.split('.');
            let ext = filenameSegments.pop();
            let filename = filenameSegments.join('.');

            if (ext !== 'png') {
                ext = 'jpg';
            }

            file.resizedName = {};
            for (let sizeName of Object.keys(imageSizes)) {
                let size = imageSizes[sizeName];
                let resizeFn = sharp(file.path)
                    .resize(size);
                if (ext == 'png') {
                    resizeFn = resizeFn.png();                    
                } else {
                    resizeFn = resizeFn.jpeg();
                }

                
                await resizeFn.toFile(`${file.destination}${filename}_${size}.${ext}`);
                file.resizedName [sizeName] = `${filename}_${size}.${ext}`;
            }

            // convert origin image to jpeg
            if (ext == 'jpg') {
                await sharp(file.path)
                .jpeg()
                .toFile(`${file.destination}${filename}_.jpg`);
                /*This magic line-code will solve the bug on Windows*/
                sharp.cache(false);
                file.filename = `${filename}_.${ext}`;
                try {
                    fs.unlinkSync(file.path);
                } catch (e) {
                    throw e;
                }
            }
            
            

            return file;
        } catch (e) {
            console.log(e);
            throw e;
        }
    }

    async downloadImage(imageUrl) {
        console.log("DOWNLOADING: ", imageUrl);
        return new Promise((resolve, reject) => {
            let NOW = new Date().getTime();
            let fileName = misc.sha1(NOW.toString());
            let path = `${(config.dictionary && config.directory.image) || "public/uploads"}/${fileName}.png`;
            var transformer = sharp()
                .png()
                .toFile(path, function (err, info) {
                    if (err) {
                        console.log(imageUrl, "=>", imageUrl);
                        reject(err);
                    } else {
                        resolve({
                            filename: `${fileName}`,
                            type: 'png',
                            path: path,
                            destination: `${(config.dictionary && config.directory.image) || "public/uploads"}/`
                        })
                    }
                });
            request(imageUrl).on('error', function (err) {
                reject(err)
            })
                .pipe(transformer);
        });
    }

    async createImageObject(src, f_image) {
        let image_resize = await this.resize(f_image);
        let f = {
            title: image_resize.originalname,
            src: `${src}/${f_image.filename}`,
        };

        for (let sizeName of Object.keys(image_resize.resizedName)) {
            f[sizeName] = `${src}/${image_resize.resizedName[sizeName]}`
        }
        return f;
    }

    async createImage (src, f_image) {
        let f = await this.createImageObject(src, f_image);
        let i_file = await schemas.Image.create(f);
        return i_file;
    }
    
    getFullImageSrc(baseUrl: string, imageObject: any) {        
        let sizes = Object.keys(config.image_size);
        sizes.push('src');
        sizes.forEach(size => {            
            if (imageObject && imageObject[size]) {
                imageObject[size] = baseUrl + imageObject[size];
            }
        });
        
        return imageObject;
    }
}

const imageHelper = new ImageHelper();
export default imageHelper;
