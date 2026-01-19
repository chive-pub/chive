import { AtpAgent } from '@atproto/api';

async function main() {
  const pdsUrl = 'https://amanita.us-east.host.bsky.network';
  const did = 'did:plc:n2zv4h5ua2ajlkvjqbotz77w';

  const agent = new AtpAgent({ service: pdsUrl });

  console.log('Testing listRecords for pub.chive.eprint.submission...');
  const response = await agent.com.atproto.repo.listRecords({
    repo: did,
    collection: 'pub.chive.eprint.submission',
    limit: 10,
  });

  console.log('Found records:', response.data.records.length);
  for (const record of response.data.records) {
    console.log('- URI:', record.uri);
    console.log('  Title:', (record.value as any).title?.substring(0, 60) + '...');
  }
}

main().catch(console.error);
