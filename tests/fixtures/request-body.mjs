// Decode once: a network chunk may end in the middle of a UTF-8 character.
export async function readRequestBody(stream){
  const chunks=[];
  for await(const chunk of stream)chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
