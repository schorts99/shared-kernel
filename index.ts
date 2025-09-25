import { FetchHTTPProvider } from "./src/http";

const fetchHTTPProvider = new FetchHTTPProvider();
const url = new URL('https://rickandmortyapi.com/api/character/1');

fetchHTTPProvider.get(url).then(() => console.log(1));
fetchHTTPProvider.get(url).then(() => console.log(2));
fetchHTTPProvider.get(url).then(() => console.log(3));

console.log(fetchHTTPProvider)
