# GymCraft - Proxy

## Table of Contents

- [Project Overview](#project-overview)
- [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Running the Application](#running-the-application)
- [Usage](#usage)
- [How does it work?](#how-does-it-work)
- [Configuration](#configuration)
- [License](#license)
- [Contact](#contact)

## Project Overview

This is a simple proxy server built with Express.js and used by the main [GymCraft](https://github.com/DamianWrooby/gym-craft) application. It is designed to bypass the Netlify serverless functions 10s timeout when calling external OpenAI API serverside. This proxy server forwards requests from the main application to the OpenAI API and returns the responses.

## Getting Started

### Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js (version 18.x or higher)
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

### Running the Application

1. Start the server:

    ```bash
    node app.js
    ```

2. The server will start on port 3000 by default.

## How does it work?

The main application, through an HTTP request, sends the user's session and OpenAI API request body. The application connects to the database verifying that the user is logged in and then sends a request to the OpenAI API. Once the response is received, it is returned to the main application.

## Configuration

You can configure the proxy server by setting the following environment variables:

- `DATABASE_URL`: Your database connection URL
- `SECRET_OPENAI_KEY`: Your OpenAI API key

To set these variables, you can create a `.env` file in the root directory of the project.

## License

This project is licensed under the MIT License. See the [LICENSE](https://opensource.org/license/mit) file for details.

## Contact

If you have any questions, feel free to reach out:

Email: 👉🏼 **dwroblewski89@gmail.com**
GitHub: [DamianWrooby](https://github.com/DamianWrooby)