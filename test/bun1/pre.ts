import * as core from "@actions/core";

console.log("pre");
console.log(`Hello ${core.getInput("name")}!`);
core.setOutput("time", new Date().toLocaleTimeString());
