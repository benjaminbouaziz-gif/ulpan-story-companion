import * as React from "react";

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

import { button, container, footer, h1, main, text, wordmark } from "./theme";

interface EmailChangeEmailProps {
  siteName: string;
  oldEmail: string;
  email: string;
  newEmail: string;
  confirmationUrl: string;
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Confirmez votre nouvelle adresse</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>{siteName}</Text>
        <Heading style={h1}>Confirmez votre nouvelle adresse</Heading>
        <Text style={text}>
          Vous avez demandé à remplacer {oldEmail} par {newEmail}. Ouvrez le lien ci-dessous pour
          confirmer ce changement.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmer l’adresse
        </Button>
        <Text style={footer}>
          Si vous n’êtes pas à l’origine de cette demande, ignorez ce courrier.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default EmailChangeEmail;
