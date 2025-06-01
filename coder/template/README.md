---
display_name: Chillspace
description: Agile Coder workspace that allows you to setup a development environment in a few clicks.
icon: https://ipfs.chillwhales.dev/ipfs/QmPA8kiC1F95xkMvFiLQfsNAnt6ijaRcxxshgC9cYpTBgM
maintainer_github: b00ste
verified: true
tags: [docker, container, nvm, pnpm, yarn, postgres]
---

# Remote Development on Docker Containers

Provision Docker containers as [Coder workspaces](https://coder.com/docs/workspaces) with this example template.

## Features

This template comes with a couple of features:

- NVM to manage node versions.
- PNPM package manager.
- yarn package manager.
- Foundry for solidity development.
- VSCode extensions pre-installed.
- PostgreSQL installed for development.
- Zsh as default shell with p10k theme
- Fira Code font default for VSCode

### Setup NVM

If you need npm or node use NVM to install the desired version.

```sh
nvm install <x> # where `<x>` is the desired node version
```

### Configure shell theme

You can run the following command in terminal to update your zsh Powerlevel10k theme. Powerlevel10k is a very flexible theme and will most likely suit any user if configured properly.

```sh
p10k configure
```

### Setup GPG keys to have verified commits

Follow these guides from Github

- [Generating a new GPG key](https://docs.github.com/en/authentication/managing-commit-signature-verification/generating-a-new-gpg-key)
- [Telling Git about your signing key](https://docs.github.com/en/authentication/managing-commit-signature-verification/telling-git-about-your-signing-key)

### Setup the postgres database

For an advanced guide check the [how-to guide](https://documentation.ubuntu.com/server/how-to/databases/install-postgresql/index.html) from Ubuntu Server documentation. For a quick setup make the follwoing changes:

#### Edit `postgresql.conf`

```sh
# Replace `<x>` with the version of installed postgres
sudo vim /etc/postgresql/<x>/main/postgresql.conf
```

Search for the line containing `listen_addresses` make sure its uncommented, I recommend setting it like this `listen_addresses = 'localhost'`.

#### Restart the database engine

```sh
sudo service postgresql restart
```

#### Creating user

```sh
sudo -u postgres createuser my_username
```

#### Creating Database

```sh
sudo -u postgres createdb my_database
```

#### Giving the user a password

```sh
sudo -u postgres -H -- psql -c "ALTER USER my_username WITH ENCRYPTED PASSWORD 'my_password';"
```

#### Make user owner of database

```sh
sudo -u postgres -H -- psql -c "ALTER DATABASE my_database OWNER TO my_username;"
```

#### Drop database

```sh
sudo -u postgres -H -- psql -c "DROP DATABASE my_database;"
```
