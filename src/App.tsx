import { useState, useEffect } from 'react';
import { popup, error, coldFetch, objectToQueryParams } from './Util.tsx';
import './App.css';

const HTTPS_BASE_URL: string = 'https://frontend-take-home-service.fetch.com';

// Special endpoints
const ENDPOINT_LOGIN: string = '/auth/login';
const ENDPOINT_LOGOUT: string = '/auth/logout';

// Do we want to send real HTTP requests or simulated requests?
const DRY_RUN: boolean = false;

// Enables debugging conveniences like pre-filled login
const DEBUG_MODE: boolean = true;

function getValue(element_name: string) {
  return (document.getElementById(element_name) as HTMLInputElement).value;
}

function fetch1(input: RequestInfo, init?: RequestInit): Promise<Response> {
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
  fetch1(`${HTTPS_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
    credentials: 'include',
  })
    .then((response) => {
      if (!response.ok) {
        if (endpoint === ENDPOINT_LOGIN) {
          error("Invalid name or email address.");
        }
        throw new Error(`HTTP error! Status: ${response.status}, Error: ${response}`);
      }
      if (endpoint === ENDPOINT_LOGIN || endpoint === ENDPOINT_LOGOUT) {
        return response;
      } else {
        return response.json();
      }
    })
    .then((data) => {
      if (dataHandler) {
        dataHandler(data);
      }
    })
    .catch((error) => {
      console.error(`HTTP POST error: ${error}`);
    });
}

function getRequestHelper(
  endpoint: string,
  params?: object,
  dataHandler?: (data: any) => void,
  extra_params?: string,
) {
  const params_string = params ? `/?${objectToQueryParams(params)}${extra_params || ""}` : '';

  fetch1(`${HTTPS_BASE_URL}${endpoint}${params_string}`, {
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

  // constants
  const ANY_BREED = 'Any';

  // state
  const [loggedIn, setLoggedIn] = useState(true);
  const [ranSearch, setRanSearch] = useState(false);
  const [loginStatus, setLoginStatus] = useState(false);
  const [dogBreeds, setDogBreeds] = useState<Array<string>>([]);
  const [selectedBreeds, setSelectedBreeds] = useState<Array<string>>([]);
  const [selectedZipCodes, setSelectedZipCodes] = useState<Array<string>>([]);
  const [dogList, setDogList] = useState<Array<Dog>>([]);
  const [favoriteDogIDs, setFavoriteDogIDs] = useState<Array<string>>([]);
  const [dogMatch, setDogMatch] = useState<Dog | null>(null);
  const [idToDog, _] = useState<Map<string, Dog>>(new Map<string, Dog>());

  function populateDogBreeds() {
    getRequestHelper('/dogs/breeds', undefined, (data: Array<string>) => {
      setDogBreeds([ANY_BREED].concat(data));
    });
  }

  function searchDogs(breeds?: Array<string>, zipCodes?: Array<string>) {

    breeds = breeds || selectedBreeds
    zipCodes = zipCodes || selectedZipCodes

    const params: Record<string, any> = {};
    const setParam = (setting: string, value: any) => {
      if (value) {
        params[setting] = value;
      }
    };

    setParam('ageMin', getValue('min-age'));
    setParam('ageMax', getValue('max-age'));
    setParam('size', getValue('num-results'));
    setParam('from', 0);
    setParam('sort', getValue('sort-by-field'));

    let breedStr = "";
    let zipCodeStr = "";

    if (breeds.length > 0) {
      for (const breed of breeds) {
        breedStr += "&breeds=";
        breedStr += breed;
      }
    }

    if (zipCodes.length > 0) {
      for (const zipCode of zipCodes) {
        zipCodeStr += "&zipCodes=";
        zipCodeStr += zipCode;
      }
    }

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
            for (const dog of data) {
              idToDog.set(dog.id, dog);
            }
          }
        });
      },
      zipCodeStr + breedStr,
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

  function findDogMatch() {
    if (favoriteDogIDs.length === 0) {
      error("You haven't favorited any dogs yet!");
      return;
    }
    postRequestHelper('/dogs/match', favoriteDogIDs, (data) => {
      setDogMatch(idToDog.get(data.match)!)
    })
  }

  function LoginPage() {

    // Note: This check is fine because DEBUG_MODE is a constant.
    // The React warning can be safely ignored.
    if (DEBUG_MODE) {

      useEffect(() => {
        const timeoutId = setTimeout(() => {
          (document.getElementById('name') as HTMLInputElement).value = 'me';
          (document.getElementById('email') as HTMLInputElement).value = 'placeholder@gmail.com';
        }, 100);

        // Cleanup function to clear timeout on unmount
        return () => clearTimeout(timeoutId);

      }, []);
    }

    return (
      <>
        <h1>Your local dog shelter</h1>
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
    useEffect(() => { }, []);

    const dogBreedChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {

      const dogBreed = e.target.value;
      let newBreeds: Array<string> = [];

      if (selectedBreeds.includes(dogBreed)) {
        return;
      }

      if (dogBreed === ANY_BREED) {
        newBreeds = [];
      } else {
        newBreeds = selectedBreeds.concat(dogBreed);
      }

      setSelectedBreeds(newBreeds);
      searchDogs(newBreeds);

    }

    const removeDogBreed = (breed: string) => {
      const newBreeds = selectedBreeds.filter((breed1: string) => breed1 !== breed);
      setSelectedBreeds(newBreeds);
      searchDogs(newBreeds);
    }

    const addZipCode = () => {

      const zipCode = (document.getElementById("zip-code") as HTMLInputElement).value
      let newZipCodes: Array<string> = [];

      if (selectedZipCodes.includes(zipCode)) {
        newZipCodes = selectedZipCodes;
      } else {
        newZipCodes = selectedZipCodes.concat(zipCode);
      }

      setSelectedZipCodes(newZipCodes);
      searchDogs(undefined, newZipCodes);

    }

    const removeZipCode = (zipCode: string) => {
      const newZipCodes = selectedZipCodes.filter((zipCode1: string) => zipCode1 !== zipCode);
      setSelectedZipCodes(newZipCodes);
      searchDogs(undefined, newZipCodes);
    }

    const favoriteDog = (dogName: String, dogID: String) => {
      popup(`Favorited <strong>${dogName}</strong>`);
      setFavoriteDogIDs(favoriteDogIDs.concat(dogID));
    }

    if (dogMatch !== null) {
      if (loggedIn) {
        // FIXME
        console.log("HERE ONCE")
        setLoggedIn(false);
        postRequestHelper(ENDPOINT_LOGOUT, undefined, ((data) => {
          if (data.status === 200) {
            console.log("Successfully logged out the user.")
          } else {
            console.log(`Unexpected status: ${data.status}`)
          }
        }))
      }
      const dog = dogMatch;
      return (
        <>
          <h1>Congratulations on your new pet dog, <strong>{dog.name}</strong>!</h1>
          <img key={dog.id} src={dog.img}></img>
        </>
      )
    }

    return (
      <>
        <h1>Your local dog shelter</h1>
        <div className="grid">

          <label htmlFor="breeds">Add breed</label>
          <select name="breeds" id="breeds" onChange={dogBreedChanged}>
            {dogBreeds.map((breed) => (
              <option key={breed} value={breed}>
                {breed}
              </option>
            ))}
          </select>

          <label htmlFor="zip-code">ZIP Code</label>
          <div style={{ display: "flex" }}>
            <input
              type="number"
              name="zip-code"
              id="zip-code"
              min="00501"
              max="99950"
              defaultValue="00501"
            />
            <button
              name="add-zip-code"
              id="add-zip-code-button"
              onClick={addZipCode}>
              Add
            </button>
          </div>

          <label htmlFor="min-age">Minimum age</label>
          <input
            type="number"
            id="min-age"
            min="0"
            max="19"
            defaultValue="0"
            onChange={() => searchDogs()}
          />

          <label htmlFor="max-age">Maximum age</label>
          <input
            type="number"
            id="max-age"
            min="0"
            max="20"
            defaultValue="20"
            onChange={() => searchDogs()}
          />

          <label htmlFor="# of results"># of results</label>
          <input
            type="number"
            id="num-results"
            min="1"
            max="100"
            defaultValue="25"
            onChange={() => searchDogs()}
          />

          <label htmlFor="sort-by-field">Sort by</label>
          <select name="sort-by-field" id="sort-by-field" onChange={() => searchDogs()}>
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

        {selectedBreeds.length > 0 && (
          <div>
            <br />
            <ul id="taglist">
              <strong>Selected breeds</strong>:&nbsp;
              {selectedBreeds.map((breed) => (
                <>
                  <li key={breed + '-selected'}>{breed}
                    <button key={breed + "-rm"} value={breed} onClick={() => removeDogBreed(breed)}>
                      (X)
                    </button>
                  </li>
                </>
              ))}
            </ul>
            <br />
          </div>
        )}

        {selectedZipCodes.length > 0 && (
          <div>
            {selectedBreeds.length == 0 && <br />}
            <ul id="taglist">
              <strong>Selected zipcodes</strong>:&nbsp;
              {selectedZipCodes.map((zipCode) => (
                <>
                  <li key={"zipCode-" + zipCode + '-selected'}>{zipCode}
                    <button key={"zipCode-" + zipCode + "-rm"} value={zipCode}
                      onClick={() => removeZipCode(zipCode)}>
                      (X)
                    </button>
                  </li>
                </>
              ))}
            </ul>
            <br />
          </div>
        )}

        <button id="search-button" onClick={() => searchDogs()}>
          SEARCH
        </button>

        <button id="match-button" onClick={() => findDogMatch()}>
          MATCH
        </button>

        <div className="search-view">
          {dogList.length === 0 && ranSearch && (
            <p key="no-search-results">
              <strong>No results found</strong>. Have you tried using a broader
              set of search parameters?
            </p>
          )}
          {dogList.map((dog: Dog) => (
            <div className="search-grid">
              <label htmlFor={dog.id} key={dog.id + '-label'}>
                {dog.name}, a {dog.age} year-old <strong>{dog.breed}</strong><br/>
                (ZIP Code {dog.zip_code})
              </label>
              <br />
              <img key={dog.id} src={dog.img}></img>
              <img key={dog.id + '-fav'} className="fav-img" src="./favorite.webp"
                onClick={() => favoriteDog(dog.name, dog.id)}></img>
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
