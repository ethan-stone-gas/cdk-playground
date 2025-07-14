# AWS Cognito SSO

This repo is a proof of concept for implementing SSO into our system.

# Terminology

- Identity Provider (IdP): A third party provider that is used for user authentication.
- Local User: A user created inside the Cognito User Pool itself. Likely through email + password.
- Federated User: A user created from IdP.

# Todo

- [x] Basic login page where a user signs up with username and password.
- [x] Page to validate a domain.
- [ ] Page to be able to configure an identity provider. This includes associating the IdP with the validated domain.
- [ ] Backend route for page that creates the Identity Provider and maps the validated domain to that identity provider.
- [ ] Implement Pre sign-up trigger that links federated users to local users.
- [ ] Update login page to parses the domain from the email and checks if it maps to an IdP, and redirects the login flow to the IdP.
- [ ] Invite others to the organization.
- [ ] Other user is able to login.

# Validating the Domain

1. Create a random string.
2. Generate a record name and record value for TXT DNS record that the user will need to create. The record name will be `_lynkwell.{userdomain} ` and the value will be `lynkwell-site-verification={random_string}`. Store the mapping in a DB somewhere.
3. User creates TXT DNS record.
4. Do DNS lookup of `_lynkwell.{userdomain}`. If the record value equals what we expect, then we can consider the domain validated.

# Mapping Domain to IdP

1. Store key value pair of domain to IdP name/ID.
2. When user logs in, parse the domain from the email.
3. Lookup if that domain maps to an IdP.
4. Redirect login to the IdP.
