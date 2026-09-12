const startedAt: Date = new Date();

const serviceName = "wix-clone-api-v2";

function describeStartup(name: string, time: Date): string {
  return `${name} started at ${time.toISOString()}`;
}

console.log(describeStartup(serviceName, startedAt));
console.log(`running on node ${process.version}`);
