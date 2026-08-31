import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { ResumeContent } from "@/lib/ai/schemas";

export interface ResumeContactInfo {
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  links: { portfolio?: string; personalWebsite?: string; linkedinUrl?: string; githubUsername?: string } | null;
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  name: { fontSize: 20, fontWeight: 700, marginBottom: 2 },
  contactRow: { fontSize: 9, color: "#444444", marginBottom: 10 },
  headline: { fontSize: 11, color: "#444444", marginBottom: 10 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
    borderBottom: "1pt solid #dddddd",
    paddingBottom: 3,
  },
  summary: { fontSize: 10, lineHeight: 1.4, marginBottom: 4 },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  entryTitle: { fontSize: 10.5, fontWeight: 700 },
  entrySubtitle: { fontSize: 9.5, color: "#333333" },
  entryDates: { fontSize: 9, color: "#666666" },
  bullet: { fontSize: 9.5, lineHeight: 1.35, marginTop: 2, marginLeft: 10 },
  skillsRow: { fontSize: 9.5, lineHeight: 1.6 },
});

function ResumeDocument({ content, contact }: { content: ResumeContent; contact: ResumeContactInfo }) {
  const links = [
    contact.links?.portfolio,
    contact.links?.personalWebsite,
    contact.links?.githubUsername ? `github.com/${contact.links.githubUsername}` : undefined,
    contact.links?.linkedinUrl,
  ].filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{contact.name}</Text>
        <Text style={styles.contactRow}>
          {[contact.email, contact.phone, contact.location, ...links].filter(Boolean).join("  |  ")}
        </Text>
        <Text style={styles.headline}>{content.headline}</Text>
        <Text style={styles.summary}>{content.summary}</Text>

        {content.experiences.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Experience</Text>
            {content.experiences.map((exp, i) => (
              <View key={i}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>
                    {exp.roleTitle} · {exp.organizationName}
                  </Text>
                  <Text style={styles.entryDates}>
                    {exp.startDate ?? ""} – {exp.isCurrent ? "Present" : (exp.endDate ?? "")}
                  </Text>
                </View>
                {exp.bullets.map((b, j) => (
                  <Text key={j} style={styles.bullet}>
                    • {b}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {content.projects.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Projects</Text>
            {content.projects.map((p, i) => (
              <View key={i} style={{ marginTop: 4 }}>
                <Text style={styles.entryTitle}>{p.name}</Text>
                <Text style={styles.bullet}>{p.description}</Text>
                {p.technologies.length > 0 && (
                  <Text style={[styles.bullet, { color: "#666666" }]}>{p.technologies.join(", ")}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {content.skills.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Skills</Text>
            <Text style={styles.skillsRow}>{content.skills.join("  ·  ")}</Text>
          </View>
        )}

        {content.educations.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Education</Text>
            {content.educations.map((e, i) => (
              <View key={i} style={styles.entryHeader}>
                <Text style={styles.entryTitle}>
                  {e.institution}
                  {e.degree ? ` — ${e.degree}` : ""}
                  {e.fieldOfStudy ? `, ${e.fieldOfStudy}` : ""}
                </Text>
                <Text style={styles.entryDates}>{e.endDate ?? ""}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

export async function renderResumePdf(content: ResumeContent, contact: ResumeContactInfo): Promise<Buffer> {
  return renderToBuffer(<ResumeDocument content={content} contact={contact} />);
}
