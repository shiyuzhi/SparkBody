import purgecss from "@fullhuman/postcss-purgecss";

export default {
  plugins: [
    purgecss({
      content: ["./index.html", "./src/**/*.{js,jsx}"],
      defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || [],
      safelist: [/^btn/, /^d-/, /^col/, /^row/]
    })
  ]
};