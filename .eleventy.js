/** @param {import('@11ty/eleventy').UserConfig} eleventyConfig */
export default function (eleventyConfig) {
    eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
    eleventyConfig.addWatchTarget("src/assets");

    return {
        pathPrefix: process.env.ELEVENTY_PATH_PREFIX || "/",
        dir: {
            input: "src",
            includes: "_includes",
            output: "_site"
        },
        templateFormats: ["njk", "md", "html"],
        markdownTemplateEngine: "njk",
        htmlTemplateEngine: "njk"
    };
}
