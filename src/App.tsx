import { useState, useEffect } from 'react';
import './App.css';
import { coldFetch, objectToQueryParams } from './Util.tsx';

const HTTPS_BASE_URL: string = 'https://frontend-take-home-service.fetch.com';

// Endpoints
const ENDPOINT_LOGIN: string = '/auth/login';

// Do we want to send real HTTP requests?
const DRY_RUN: boolean = false;

const DEBUG_MODE: boolean = true;

function getValue(element_name: string) {
  return (document.getElementById(element_name) as HTMLInputElement).value;
}

function safeFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const params = init ? JSON.stringify(init) : '';
  if (DRY_RUN) {
    console.log(`Running dry fetch on input ${input} (params=${params})`);
    return coldFetch(input, init);
  } else {
    console.log(`Running real fetch on input ${input} (params=${params})`);
    return fetch(input, init);
  }
}

function postRequestHelper(
  endpoint: string,
  body?: object,
  dataHandler?: (data: any) => void,
) {
  safeFetch(`${HTTPS_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
    credentials: 'include',
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      // FIXME
      if (endpoint === ENDPOINT_LOGIN) {
        return response;
      } else {
        return response.json();
      }
    })
    .then((data) => {
      // Handle the response data
      console.log(`POST data: ${data}`);
      if (dataHandler) {
        dataHandler(data);
      }
    })
    .catch((error) => {
      console.error(`HTTP POST ERROR: ${error}`);
    });
}

function getRequestHelper(
  endpoint: string,
  params?: object,
  dataHandler?: (data: any) => void,
) {
  const params_string = params ? `/?${objectToQueryParams(params)}` : '';

  safeFetch(`${HTTPS_BASE_URL}${endpoint}${params_string}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP GET error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data: any) => {
      // Handle the response data
      console.log('GET data', data);
      if (dataHandler) {
        dataHandler(data);
      }
    })
    .catch((error) => {
      console.error(error);
    });
}

interface Dog {
  age: number;
  breed: string;
  id: string;
  img: string;
  name: string;
  zip_code: string;
}

function App() {
  const [loginStatus, setLoginStatus] = useState(false);
  const [dogBreeds, setDogBreeds] = useState<Array<string>>([]);
  const [zipCodes] = useState<Array<string>>([]);
  const [dogList, setDogList] = useState<Array<Dog>>([]);
  const [ranSearch, setRanSearch] = useState(false);

  function populateDogBreeds() {
    getRequestHelper('/dogs/breeds', undefined, (data: Array<string>) => {
      setDogBreeds(['Any'].concat(data));
    });
  }

  function searchDogs() {
    const params: Record<string, any> = {};
    const setParam = (setting: string, value: any) => {
      if (value) {
        params[setting] = value;
      }
    };

    const breeds = getValue('breeds');
    if (breeds !== 'Any') {
      setParam('breeds', breeds);
    }

    setParam('zipCodes', getValue('zip-codes'));
    setParam('ageMin', getValue('min-age'));
    setParam('ageMax', getValue('max-age'));
    setParam('size', getValue('num-results'));
    // FIXME
    setParam('from', 0);
    setParam('sort', getValue('sort-by-field'));

    getRequestHelper(
      '/dogs/search',
      params,
      (data: Record<string, Array<string>>) => {
        postRequestHelper('/dogs/', data.resultIds, (data: Array<Dog>) => {
          if (data.length === 0) {
            setRanSearch(true);
            setDogList([]);
          } else {
            setDogList(data);
          }
        });
      },
    );
  }

  function loginRequest() {
    postRequestHelper(
      ENDPOINT_LOGIN,
      {
        name: getValue('name'),
        email: getValue('email'),
      },
      (data) => {
        if (data.status == 200) {
          setLoginStatus(true);
          populateDogBreeds();
        }
      },
    );
  }

  function LoginPage() {

    // Note: This check is fine because DEBUG_MODE is a constant
    if (DEBUG_MODE) {
      useEffect(() => {
        const timeoutId = setTimeout(() => {
          (document.getElementById('name') as HTMLInputElement).value = 'me';
          (document.getElementById('email') as HTMLInputElement).value =
            'me@gmail.com';
        }, 100);

        // Cleanup function to clear timeout on unmount
        return () => clearTimeout(timeoutId);
      }, []);
    }

    /* FIXME sizes */
    return (
      <>
        <h1>Dog Shelter</h1>
        <br />
        <div className="grid">
          <label htmlFor="name">Name</label>
          <input type="input" id="name" />
          <label htmlFor="email">Email</label>
          <input type="input" id="email" />
        </div>
        <br />
        <button onClick={loginRequest}>LOGIN</button>
      </>
    );
  }

  function SearchPage() {
    useEffect(() => {}, []);
    return (
      <>
        <h1>Dog Shelter</h1>
        <div className="grid">
          <label htmlFor="breeds">Breeds</label>
          <select name="breeds" id="breeds" onChange={searchDogs}>
            {dogBreeds.map((breed) => (
              <option key={breed} value={breed}>
                {breed}
              </option>
            ))}
          </select>

          <label htmlFor="zip-codes">Zip codes</label>
          <select name="zip-codes" id="zip-codes" onChange={searchDogs}>
            {zipCodes.map((zipcode) => (
              <option key={zipcode} value={zipcode}>
                {zipcode}
              </option>
            ))}
          </select>

          <label htmlFor="min-age">Minimum age</label>
          <input
            type="number"
            id="min-age"
            min="0"
            max="19"
            defaultValue="0"
            onChange={searchDogs}
          />

          <label htmlFor="max-age">Maximum age</label>
          <input
            type="number"
            id="max-age"
            min="0"
            max="20"
            defaultValue="20"
            onChange={searchDogs}
          />

          <label htmlFor="# of results"># of results</label>
          <input
            type="number"
            id="num-results"
            min="1"
            max="100"
            defaultValue="25"
            onChange={searchDogs}
          />

          <label htmlFor="sort-by-field">Sort by</label>
          <select name="sort-by-field" id="sort-by-field" onChange={searchDogs}>
            <option value="breed:asc">Breed (A-Z)</option>
            <option value="breed:desc">Breed (Z-A)</option>
            <option value="name:asc">Name (A-Z)</option>
            <option value="name:desc">Name (Z-A)</option>
            <option value="age:asc">Age (asc)</option>
            <option value="age:desc">Age (desc)</option>
          </select>
          <br />
          <br />
        </div>

        <button id="search-button" onClick={searchDogs}>
          SEARCH
        </button>

        <div className="search-view">
          {dogList.length === 0 && ranSearch && (
            <p key="no-search-results">
              No results found. Have you tried a broader set of search
              parameters?
            </p>
          )}
          {dogList.map((dog: Dog) => (
            <div className="search-grid">
              <label htmlFor={dog.id} key={dog.id + '-label'}>
                {dog.name}, a {dog.age} year-old {dog.breed} (zip {dog.zip_code}
                )
              </label>
              <br />
              <img key={dog.id} src={dog.img}></img>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (loginStatus) {
    return SearchPage();
  } else {
    return LoginPage();
  }
}

export default App;
