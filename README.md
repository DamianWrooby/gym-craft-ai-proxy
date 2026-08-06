# GymCraft - Proxy

## Table of Contents

- [Project Overview](#project-overview)
- [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Running the Application](#running-the-application)
- [API](#api)
- [How does it work?](#how-does-it-work)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [License](#license)
- [Contact](#contact)

## Project Overview

This is a proxy server built with Express.js and used by the main [GymCraft](https://github.com/DamianWrooby/gym-craft) application. It is designed to bypass the Netlify serverless functions 10s timeout for slow server-side calls — both to the OpenAI API (workout plan generation, weekly reports, run explanations) and to the Python Garmin microservice (activity backfill). This proxy server forwards requests from the main application to those services and returns the responses.

## Getting Started

### Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js 20.x (pinned in `engines`)
- npm (version 10.x or higher)

### Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/DamianWrooby/gym-craft-ai-proxy
    cd gym-craft-ai-proxy
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Create a `.env` file in the root directory — see [Configuration](#configuration).

### Running the Application

1. Start the server:

    ```bash
    npm start
    ```

    This runs `nodemon app.js` and reloads on changes. For a plain, non-watching process (what runs in production) use `node app.js`.

2. The server will start on port 3000 by default, or on `PORT` if it is set.

There is no test suite (`npm test` is a placeholder). Format the code with `npx prettier --write .`.

## API

All endpoints are `POST` and speak JSON. CORS is restricted to the app origins (`http://localhost:5173`, `https://gymcraft.damianwroblewski.com`).

| Endpoint                 | Body                       | Purpose                                                                                                                        |
| ------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/api/generate-plan`     | `{ session, formData }`    | Validates the survey form, authenticates the session, generates a plan with OpenAI and converts it to Garmin Connect workouts. |
| `/api/weekly-report`     | `{ system, user, model? }` | Text completion, returned as `{ summary }`.                                                                                    |
| `/api/explain-run`       | `{ system, user, model? }` | Text completion, returned as `{ analysis }`.                                                                                   |
| `/api/garmin-activities` | `{ startDate, endDate? }`  | Relays an activity list request to the Python Garmin microservice.                                                             |

Notes:

- `/api/generate-plan` responds `401 { code: 'INVALID_SESSION', message }` when the session token is missing or no longer matches a user — the app should send the user through login again.
- The optional `model` field is subscription tier based and is only honored for ids listed in `allowedModels` (`app/config/openAI.config.js`); anything else falls back to the default model.
- `/api/garmin-activities` takes the user's session as an `Authorization: Bearer …` header and forwards it to the Garmin microservice, which validates it. No Garmin credentials pass through this proxy. Errors come back as `{ code, message }`, with `code: 'INVALID_TOKEN'` when the session needs re-authentication.

## How does it work?

For plan generation, the main application sends the user's session together with the survey form data. The proxy validates the form, connects to the database verifying that the session belongs to a logged-in user, and then sends a request to the OpenAI API. Once the response is received, each workout is converted into the Garmin Connect workout format and returned to the main application.

The text endpoints are thinner: they take ready-made system/user prompts from the main app and return the completion text. The Garmin endpoint is a pure relay to the Python microservice and touches neither the database nor OpenAI.

## Configuration

You can configure the proxy server by setting the following environment variables:

- `DATABASE_URL`: Your database connection URL
- `SECRET_OPENAI_KEY`: Your OpenAI API key
- `SECRET_INTERNAL_GARMIN_API_URL`: Base URL of the Python Garmin microservice (used by `/api/garmin-activities`)
- `SECRET_INTERNAL_API_KEY`: Optional `X-API-Key` sent to that microservice
- `PORT`: Port to listen on (defaults to 3000; provided by the platform in production)

To set these variables, you can create a `.env` file in the root directory of the project.

## Deployment

The service is deployed on [Render](https://render.com/) as a web service. The process is defined in the `Procfile` (`web: node app.js`) and binds to the `PORT` provided by the platform. The environment variables listed in [Configuration](#configuration) have to be set in the Render dashboard.

## License

This project is licensed under the MIT License. See the [LICENSE](https://opensource.org/license/mit) file for details.

## Contact

If you have any questions, feel free to reach out:

Email: 👉🏼 **dwroblewski89@gmail.com**
GitHub: [DamianWrooby](https://github.com/DamianWrooby)
