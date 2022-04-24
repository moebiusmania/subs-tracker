module.exports = {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  daisyui: {
    //themes: ["dark", "light"],
    themes: ["light", "dark"],
  },
  plugins: [require("daisyui")],
};
